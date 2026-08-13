# SP: pValidarIGTF
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-08-2015>
-- Description:	<pValidarIGTF>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarIGTF]
	(


		@bCorregir BIT = 0, --INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
		@IdProcess UNIQUEIDENTIFIER = NULL
	)
AS
	BEGIN
		--SET NOCOUNT OFF;

		DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )
		DECLARE @pIdR UNIQUEIDENTIFIER
		DECLARE @pMov_Num CHAR(20)
		DECLARE @pMontoAct DECIMAL(18,2)
		DECLARE @pMontoNew DECIMAL(18,2)
		DECLARE @bConciliado BIT
		DECLARE @bContabilizado BIT
		DECLARE @pPorDebe BIT
		DECLARE @PistaMensaje AS VARCHAR(MAX)
		DECLARE @HoraCorrida DATETIME
		DECLARE @tipo_opcursor varchar (3) 
		DECLARE @monto_d_ID decimal (18,2)
		DECLARE @monto_h_ID decimal (18,2)
		DECLARE @tipo_op_dyh varchar (7)
	    Declare @ManejaIDBNew int
		
        Select @ManejaIDBNew = cb_manej_imp_cuenta from par_emp	
		


		DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
				FOR
					SELECT
						Mv.rowguid, Mv.mov_num, idb as monto_act, 0.00 as monto_new,
						conciliado, 0 as por_debe,
						CASE WHEN Mv.numcom <> 0 AND Mv.feccom > '01-01-1900' 
                                THEN
                                1
                                ELSE
								0
                                END
                                AS contabilizado --CASE PARA EL VALOR DE CONTABILIZADO
					FROM
						saMovimientoBanco MV
					WHERE
						MV.idb <> 0 AND
								   (
										  (MV.monto_h > 0  and NOT(MV.tipo_op = 'NC' and MV.origen ='CHD')) -- Que no sean cheque devuelto
/*Jortiz situacion: 113222, Se cambio de igual a ID a diferente de ID*/ and (MV.tipo_op <> 'ID') -- Tipo IDB
										  --OR (MV.monto_d > 0 and MV.origen = 'BAN' and MV.cob_pag is not null) -- Transferencias
								
   )
								   --jortiz 07/03/22 inicia situacion: 113222
	UNION
	--Se hace consulta para obtener tipo de operaciones ID
					SELECT
						Mv.rowguid, Mv.mov_num, idb as monto_act , 
						CASE WHEN monto_d>0 THEN   monto_d
					         WHEN monto_h>0 THEN   monto_h 
							
                       END as monto_new, 
						conciliado, 0 as por_debe,

						CASE WHEN Mv.numcom <> 0 AND Mv.feccom > '01-01-1900' 
                                THEN
                                1
                                ELSE
								0
                                END
```
