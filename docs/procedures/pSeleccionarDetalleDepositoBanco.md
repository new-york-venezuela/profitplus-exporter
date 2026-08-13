# SP: pSeleccionarDetalleDepositoBanco
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvValeAlimentacion`](../tables/pvValeAlimentacion.md)
- [`saBanco`](../tables/saBanco.md)
- [`saCaja`](../tables/saCaja.md)
- [`saDepositoBancoReng`](../tables/saDepositoBancoReng.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saTarjetaCredito`](../tables/saTarjetaCredito.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pSeleccionarDetalleDepositoBanco
DESCRIPCION	: Obtiene el detalle de las formas de pago usadas en un deposito dado
CREADO POR	: SOFTECH SISTEMAS
FECHA CREADO: <2014-01-20>
FECHA MODIFICADO: <2019-09-30>
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarDetalleDepositoBanco]
(
	@sDep_Num CHAR(20) 
)
AS 
BEGIN
    SELECT	MOVC.forma_pag AS TipoFP, MOVC.num_pago AS Num_CH, DEPB.monto AS  Monto_MovCaj, MOVC.co_ban AS Co_BanCH, BAN.des_ban AS Descrip_BanCH,

		CASE WHEN TC.des_tar IS NULL THEN VA.vale_descrip ELSE TC.des_tar END AS Descrip_FP,
		CASE WHEN MOVC.co_tar IS NULL THEN  MOVC.co_vale ELSE MOVC.co_tar END AS Cod_FP,
		
		DEPB.porc_comision AS Porc_ComisionFP,
		DEPB.porc_impuesto AS Porc_ImpFP,
		DEPB.comision AS Monto_ComisionFP,
		DEPB.impuesto AS Monto_ImpFP,
		DEPB.monto - DEPB.comision - DEPB.impuesto AS Monto_DepFP
		
	FROM saDepositoBancoReng DEPB
		INNER JOIN saCaja CAJ				ON		DEPB.Codigo		=		CAJ.cod_caja
		INNER JOIN saMovimientoCaja MOVC	ON		MOVC.mov_num	=		DEPB.mov_afec_c
		LEFT JOIN saBanco BAN				ON		BAN.co_ban		=		MOVC.co_ban
		LEFT JOIN saTarjetaCredito TC		ON		TC.co_tar		=		MOVC.co_tar 
		LEFT JOIN pvValeAlimentacion VA		ON		VA.co_vale		=		MOVC.co_vale
	WHERE
		DEPB.dep_num = @sDep_Num
	ORDER BY MOVC.forma_pag
END
```
