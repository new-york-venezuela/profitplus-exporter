# SP: pSeleccionarMovimientoBanco
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCheque`](../tables/saCheque.md)
- [`saChequera`](../tables/saChequera.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
/*************************************************************************************************
*NOMBRE			:	pSeleccionarMovimientoBanco
*DESCRIPCION	:	Selecciona un registro de la tabla  saMovimientoBanco
*FECHA CREACIÓN :   <2011-12-12>
*FECHA MODIFICACIÓN:<2020-01-13>
*CREADO			:	SOFTECH SISTEMAS
**************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarMovimientoBanco] ( @sMov_Num CHAR(20) )
AS 
    BEGIN
		Declare @tsMarcaTiempoCheque TIMESTAMP
		Declare @mbDocNum varchar(20)
		Declare @mbCodCta char(6)
		
		Select @mbDocNum = mb.doc_num, @mbCodCta =  mb.cod_cta
			From saMovimientoBanco mb
		Where mb.tipo_op = 'CH' and  mb.mov_num = @sMov_Num
		
		If @mbDocNum is null
			Set @tsMarcaTiempoCheque = null
		Else
		Begin
			Select @tsMarcaTiempoCheque = CH.validador From saCheque CH
			Inner Join saChequera CHRA ON CH.co_chra = CHRA.co_chra
			Where CH.co_cheq = @mbDocNum and CHRA.cod_cta = @mbCodCta
		End

       SELECT
            mov_num, descrip,cod_cta,co_cta_ingr_egr,fecha,tasa, tipo_op, doc_num, monto_d,monto_h, CASE WHEN Tipo_Op IN ('ID') then 0 ELSE idb
            END AS idb,[saldo_ini], [origen], [cob_pag], [dep_num], [conciliado],[ori_dep], [anulado], [dep_con], [fec_con], [cod_ingben],[fecha_che],
			[feccom], [numcom], [dis_cen], [campo1], [campo2], [campo3], [campo4], [campo5], [campo6], [campo7], [campo8], [co_us_in],[co_sucu_in],
			[fe_us_in], [co_us_mo], [co_sucu_mo], [fe_us_mo], [trasnfe], [revisado], [validador], [rowguid], [nro_transf_nomi], @tsMarcaTiempoCheque AS MarcaTiempoCheque, 
			CASE WHEN Tipo_Op IN ( 'CH', 'ND', 'RC', 'TR' ) THEN Monto_d WHEN Tipo_Op IN ('ID') then idb ELSE monto_h END AS monto
        FROM
            saMovimientoBanco mb
        WHERE
            mb.mov_num = @sMov_Num 

    END
```
