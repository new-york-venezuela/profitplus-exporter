# SP: RepFormatoTrasladoCaracteristica
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saSubLinea`](../tables/saSubLinea.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: RepFormatoTrasladoCaracteristica
DESCRIPCION: Reporte Formato Traslado con sus Caracteristica
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[RepFormatoTrasladoCaracteristica]
	-- Add the parameters for the stored procedure here
    @sTras_Num_d CHAR(20) = NULL ,
    @sTras_Num_h CHAR(20) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,    
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
SELECT  E.alm_orig, E.alm_dest, E.motivo_glo, E.fec_conf,(case when E.confirma='1' then 'SI' ELSE 'NO' end) as confirma, E.tras_num, 
        R.reng_num, R.co_art, a.modelo, a.art_des,R.co_uni, R.total_art as 'Cantidad', 
        v.cantidad as 'CantidadCaracteristica',
		sub_01.subl_des as subl_des01, sub_02.subl_des as subl_des02,
		sub_03.subl_des as subl_des03,  sub_04.subl_des as subl_des04, 
		sub_05.subl_des as subl_des05
FROM    dbo.saTraslado E 
		INNER JOIN dbo.saTrasladoReng R ON E.tras_num = R.tras_num 
		INNER JOIN dbo.savArtCaracteristicaTRAS V ON R.reng_num = v.reng_num and r.tras_num = v.num_doc
		inner join saArticulo A on a.co_art = r.co_art
		left join sasublinea as sub_01 on sub_01.co_lin = v.co_lin01 and sub_01.co_subl = v.co_subl01
		left join sasublinea as sub_02 on sub_02.co_lin = v.co_lin02 and sub_02.co_subl = v.co_subl02
		left join sasublinea as sub_03 on sub_03.co_lin = v.co_lin03 and sub_03.co_subl = v.co_subl03
		left join sasublinea as sub_04 on sub_04.co_lin = v.co_lin04 and sub_04.co_subl = v.co_subl04
		left join sasublinea as sub_05 on sub_05.co_lin = v.co_lin05 and sub_05.co_subl = v.co_subl05
 WHERE
		(@sTras_Num_d IS NULL OR  E.tras_num >= @sTras_Num_d)
	AND (@sTras_Num_h IS NULL OR  E.tras_num <= @sTras_Num_h)
	AND (@sCo_Sucursal IS NULL OR e.co_sucu_in = @sCo_Sucursal)
	AND (v.tipo_doc='TRAS')
        ORDER BY
            E.tras_num
    END
```
