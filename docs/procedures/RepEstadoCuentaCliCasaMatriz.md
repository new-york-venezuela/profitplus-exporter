# SP: RepEstadoCuentaCliCasaMatriz
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <27-09-10>
-- Description:	<Estado de cuenta de Clientes (Casa Matriz)>
-- =============================================
CREATE  PROCEDURE [dbo].[RepEstadoCuentaCliCasaMatriz]
	-- Add the parameters for the stored procedure here
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_Cli CHAR(16) = NULL ,
    @sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
    @sTipo_pro CHAR(6) = NULL ,
    @sDetalle CHAR(4) = NULL ,
    @sProve_sin_mov CHAR(4) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;



		


	
        DECLARE @fechadiff INT ;
        SET @fechadiff = DATEDIFF(dd, 00, GETDATE()) ;
 
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = DATEADD(ss, -60, DATEADD(day, 1, @dFecha_h))

        IF @dFecha_d IS NOT NULL 
            SET @dFecha_d = DATEADD(ss, -60, DATEADD(day, 1, @dFecha_d))

--select @dFecha_d,@dFecha_h
		SET @dFecha_h = dbo.FechaSimple(@dFecha_h)
        SET @dFecha_d = dbo.FechaSimple(@dFecha_d)


		
        IF ( @sDetalle = 'SI'
             OR @sDetalle IS NULL
           )
            AND ( @sProve_sin_mov = 'NO'
                  OR @sProve_sin_mov IS NULL
                ) 
				declare @tipo_cliente int
				-- inicia sit 124438 jortiz
				if (@sCo_Cli is not null)
				begin
				set @tipo_cliente = (select tipo_adi from saCliente where co_cli = @sCo_Cli)
				end
				-- finaliza sit 124438 jortiz
			

            SELECT
                A.*, 
				
				B.*, 'Cliente' AS tipo_rep,
				
				CASE WHEN C.cli_des is null 
				THEN 
				A.prov_des
				
				ELSE
				C.cli_des 
				END  Cliente_matriz 
            FROM
                ( SELECT   DISTINCT
                    DC.co_tipo_doc AS descrip, '' cob_num, DC.nro_doc, 
					
					case  when P.tipo_adi = '2' then 'CM' else 'SUC' end as tipo_cliente,
					
					DC.fec_emis, DC.fec_venc, DC.co_tipo_doc,
                    DC.total_neto, 0.00 AS MONTO, DC.saldo, '' AS nro_fact, DC.nro_orig,
                    CASE WHEN TD.tipo_mov = 'DE' THEN DC.total_neto
                         ELSE 0.00
                    END AS tot_debe, ( CASE WHEN TD.tipo
```
